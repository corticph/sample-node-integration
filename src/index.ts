import dotenv from 'dotenv';
import express from 'express'
import bodyParser from 'body-parser'
import sessionRoutes from './routes/session'
import eventsRoute from './routes/events'
// Continue importing other routes as required

// setup express app
const app = express()
dotenv.config();
const port = process.env.PORT;

// bodyParser setup
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

// use imported routes
app.use(sessionRoutes)
app.use(eventsRoute)
// Continue using other imported routes as required

// set the app to listen on the port
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`)
})
