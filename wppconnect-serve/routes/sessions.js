const sessions = {};

function registerSession(sessionName) {
  sessions[sessionName] = { status: 'offline' };
}

function setSessionStatus(sessionName, status) {
  if (!sessions[sessionName]) {
    sessions[sessionName] = {};
  }
  sessions[sessionName].status = status;
}

function registerSessionsRoute(app) {
  app.get('/sessions', (req, res) => {
    res.json(sessions);
  });
}

module.exports = { registerSession, setSessionStatus, registerSessionsRoute };
