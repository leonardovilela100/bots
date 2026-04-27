const wppconnect = require('@wppconnect-team/wppconnect');
const express = require('express');
const path = require('path');
const fs = require('fs');
const { setLastQrData, registerQrRoute } = require('./routes/qrCode');
const { registerSendMessageRoute } = require('./routes/sendMessage');
const { registerMessageListener } = require('./listeners/messageListener');
const {
  registerSession,
  setSessionStatus,
  registerSessionsRoute,
} = require('./routes/sessions');

const sessionName = 'server-session';
const tokenFolder = path.resolve(__dirname, 'tokens');
const browserProfileFolder = path.join(tokenFolder, sessionName);
const reconnectDelayMs = Number(process.env.WPP_RECONNECT_DELAY_MS || 10000);
const healthCheckDelayMs = Number(process.env.WPP_HEALTHCHECK_DELAY_MS || 20000);
const browserExecutableCandidates = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];

const fileTokenStore = new wppconnect.tokenStore.FileTokenStore({
  path: tokenFolder,
});

const app = express();
app.use(express.json());

let activeClient = null;
let initPromise = null;
let reconnectTimer = null;
let healthCheckTimer = null;
let clientGeneration = 0;

registerSession(sessionName);
setSessionStatus(sessionName, 'initializing');

registerSendMessageRoute(app, () => activeClient);
registerQrRoute(app);
registerSessionsRoute(app);

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function clearHealthCheckTimer() {
  if (healthCheckTimer) {
    clearTimeout(healthCheckTimer);
    healthCheckTimer = null;
  }
}

function isClientRuntimeAlive(client) {
  try {
    if (!client?.page) {
      return false;
    }

    if (typeof client.page.isClosed === 'function' && client.page.isClosed()) {
      return false;
    }

    const browser = typeof client.page.browser === 'function' ? client.page.browser() : null;
    if (browser && browser.connected === false) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to inspect WPPConnect client runtime', error);
    return false;
  }
}

function cleanupSessionArtifacts() {
  const artifactNames = [
    'DevToolsActivePort',
    'SingletonCookie',
    'SingletonLock',
    'SingletonSocket',
  ];

  for (const artifactName of artifactNames) {
    const artifactPath = path.join(browserProfileFolder, artifactName);

    try {
      if (fs.existsSync(artifactPath)) {
        fs.rmSync(artifactPath, { force: true });
      }
    } catch (error) {
      console.error(`Failed to remove stale session artifact: ${artifactPath}`, error);
    }
  }
}

function getPreferredBrowserExecutablePath() {
  for (const browserPath of browserExecutableCandidates) {
    if (fs.existsSync(browserPath)) {
      return browserPath;
    }
  }

  return undefined;
}

async function resetClient(reason) {
  const clientToClose = activeClient;
  activeClient = null;

  if (!clientToClose) {
    cleanupSessionArtifacts();
    return;
  }

  setSessionStatus(sessionName, `resetting: ${reason}`);

  try {
    if (isClientRuntimeAlive(clientToClose)) {
      await clientToClose.close();
    }
  } catch (error) {
    console.error(`Failed to close WPPConnect client during reset (${reason})`, error);
  } finally {
    cleanupSessionArtifacts();
  }
}

async function reconnectClient(reason) {
  clearReconnectTimer();
  clearHealthCheckTimer();

  console.warn(`Reconnecting WPPConnect client. Reason: ${reason}`);

  try {
    await resetClient(reason);
    await initializeClient(`reconnect:${reason}`);
  } catch (error) {
    console.error(`Reconnect attempt failed (${reason})`, error);
    scheduleReconnect(`retry-after-failure:${reason}`, reconnectDelayMs);
  }
}

function scheduleReconnect(reason, delayMs = reconnectDelayMs) {
  if (reconnectTimer) {
    return;
  }

  console.warn(`Scheduling WPPConnect reconnect in ${delayMs}ms. Reason: ${reason}`);
  setSessionStatus(sessionName, `reconnecting: ${reason}`);

  reconnectTimer = setTimeout(() => {
    reconnectClient(reason).catch((error) => {
      console.error(`Unhandled reconnect failure (${reason})`, error);
    });
  }, delayMs);
}

function scheduleHealthCheck(reason, delayMs = healthCheckDelayMs) {
  if (healthCheckTimer) {
    return;
  }

  console.warn(`Scheduling WPPConnect health check in ${delayMs}ms. Reason: ${reason}`);

  healthCheckTimer = setTimeout(() => {
    healthCheckTimer = null;

    if (!activeClient) {
      scheduleReconnect(`healthcheck:no-active-client:${reason}`, 1000);
      return;
    }

    if (!isClientRuntimeAlive(activeClient)) {
      scheduleReconnect(`healthcheck:dead-runtime:${reason}`, 1000);
      return;
    }

    console.log(`Health check passed, keeping current session. Reason: ${reason}`);
  }, delayMs);
}

function attachClientListeners(client) {
  const generation = ++clientGeneration;
  const isCurrentClient = () => activeClient === client && generation === clientGeneration;

  client.onStateChange((state) => {
    if (!isCurrentClient()) return;

    console.log(`[${sessionName}] state -> ${state}`);
    setSessionStatus(sessionName, state);

    if (state === 'DISCONNECTED') {
      scheduleHealthCheck(`state:${state}`);
    }
  });

  client.onStreamChange((stream) => {
    if (!isCurrentClient()) return;

    console.log(`[${sessionName}] stream -> ${stream}`);

    if (stream === 'DISCONNECTED') {
      scheduleHealthCheck(`stream:${stream}`);
    }
  });

  client.onInterfaceChange((uiState) => {
    if (!isCurrentClient()) return;

    const mode = uiState?.mode || 'unknown';
    const info = uiState?.info || 'unknown';
    setSessionStatus(sessionName, `interface:${mode}:${info}`);
  });

  if (client.page?.on) {
    client.page.on('close', () => {
      if (!isCurrentClient()) return;

      console.warn(`[${sessionName}] page closed`);
      scheduleReconnect('page-close', 3000);
    });

    client.page.on('error', (error) => {
      if (!isCurrentClient()) return;

      console.error('WPPConnect page error', error);
      scheduleReconnect('page-error', 3000);
    });
  }

  if (client.page?.browser) {
    const browser = client.page.browser();

    if (browser?.on) {
      browser.on('disconnected', () => {
        if (!isCurrentClient()) return;

        console.warn(`[${sessionName}] browser disconnected`);
        scheduleReconnect('browser-disconnected', 3000);
      });
    }
  }

  registerMessageListener(client);
}

async function initializeClient(reason = 'startup') {
  if (initPromise) {
    return initPromise;
  }

  cleanupSessionArtifacts();

  console.log(`Initializing WPPConnect client. Reason: ${reason}`);
  setSessionStatus(sessionName, `initializing: ${reason}`);

  initPromise = wppconnect
    .create({
      session: sessionName,
      catchQR: (base64Qr, asciiQR, attempts, urlQR) => {
        setLastQrData({ base64Qr, asciiQR, attempts, urlQR });
      },
      statusFind: (status, session) => {
        console.log(`[${session}] statusFind -> ${status}`);
        setSessionStatus(session, status);

        if (status === 'browserClose' || status === 'serverClose') {
          scheduleReconnect(`statusFind:${status}`, 3000);
        }
      },
      onStreamInfoChanged: (info) => {
        setSessionStatus(sessionName, `stream-info:${info}`);
      },
      onStreamModeChanged: (mode) => {
        setSessionStatus(sessionName, `stream-mode:${mode}`);
      },
      folderNameToken: tokenFolder,
      tokenStore: fileTokenStore,
      autoClose: 0,
      deviceSyncTimeout: 0,
      waitForLogin: true,
      whatsappVersion: null,
      puppeteerOptions: {
        executablePath: getPreferredBrowserExecutablePath(),
      },
    })
    .then((client) => {
      clearReconnectTimer();
      clearHealthCheckTimer();
      activeClient = client;
      setSessionStatus(sessionName, 'online');
      attachClientListeners(client);
      return client;
    })
    .catch((error) => {
      console.error('Error initializing wppconnect', error);

      setSessionStatus(
        sessionName,
        `error: ${error?.message || error?.toString?.() || 'unknown'}`
      );

      scheduleReconnect('create-failed');
      throw error;
    })
    .finally(() => {
      initPromise = null;
    });

  return initPromise;
}

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception', error);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`wppconnect server listening on ${port}`);
});

initializeClient().catch(() => {});
