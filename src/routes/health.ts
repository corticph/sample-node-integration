import express from 'express'

const router = express.Router()

// Liveness probe — lets a CAD (or the test scripts) confirm the
// integration is up without opening a session or touching the desktop app.
router.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' })
})

export default router
