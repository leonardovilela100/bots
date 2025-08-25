let lastQrData = null;

function setLastQrData(data) {
  lastQrData = data;
}

function registerQrRoute(app) {
  app.get('/qr-code', (req, res) => {
    if (!lastQrData) {
      return res.status(404).json({ error: 'QrCode not generated yet' });
    }
    res.json(lastQrData);
  });
}

module.exports = { setLastQrData, registerQrRoute };
