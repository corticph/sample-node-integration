import dotenv from 'dotenv'
dotenv.config()

import { createApp } from './app'

const port = process.env.PORT || 45002
const app = createApp()

// set the app to listen on the port
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`)
})
