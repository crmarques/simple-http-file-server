const express = require('express')
const helmet = require('helmet')
const path = require('path')
const multer = require('multer');
const uuid = require('uuid')

const port = process.env.PORT || 3000
const token = process.env.ACCESS_TOKEN || uuid.v4()
const store = process.env.FILE_STORE_DIR || "/tmp"
const fileLimit = process.env.FILE_SIZE_LIMITE || 10485760 // 10M

if (!process.env.ACCESS_TOKEN)
  console.log("Self-generated access token: " + token)

const normalizedStore = path.normalize(store)

const app = express()

// security middlewares
app.use(helmet())
app.use((req, res, next) => {
  if (req.headers.authorization === "Bearer " + token)
    next()
  else
    res.sendStatus(403)
})

app.get('/', (req, res) => {
  res.send('Welcome to simple http file server!')
})

app.use('/files', express.static(normalizedStore))

const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, normalizedStore);
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname);
    }
  }),
  limits: {
    fileSize: fileLimit
  },
});

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file)
    res.json({
      status: "error",
      message: "Error saving file."
    })
  else
    res.json({
      status: "ok"
    })
})

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`)
})
