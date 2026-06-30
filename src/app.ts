import express from 'express'
import bodyParser from 'body-parser'
import healthRoute from './routes/health'
import sessionRoutes from './routes/session'
import eventsRoute from './routes/events'
// Continue importing other routes as required

// Builds the Express app. Kept separate from index.ts so tests can mount
// the app without binding to a port or starting the listener.
export const createApp = () => {
  const app = express()

  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({ extended: false }))

  app.use(healthRoute)
  app.use(sessionRoutes)
  app.use(eventsRoute)
  // Continue using other imported routes as required

  return app
}
