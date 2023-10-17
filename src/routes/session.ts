import express from 'express'
import { openSession, leaveSession } from '../controllers/sessionController'

const router = express.Router()

router.post('/openCortiSession', openSession)
router.post('/leaveCortiSession', leaveSession)

export default router