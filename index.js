const zlib = require('zlib')
const axios = require('axios')

const unarchiveLogData = async (payload) => {
  const rawData = await new Promise((resolve, reject) => {
    zlib.gunzip(payload, (err, result) => {
      if (err) {
        return reject(err)
      }

      return resolve(result)
    })
  })
  
  return JSON.parse(rawData.toString('utf8'))
}

exports.handler = async (event, context, callback) => {
  try {
    const { TOKEN } = process.env

    if (!TOKEN) {
      throw new Error('TOKEN is required')
    }

    const sendToPapertrail = (event) => {
      axios.post('https://logs.collector.solarwinds.com/v1/log', event.message, {
        auth: {
          password: TOKEN,
        },
      })
    }

    const payload = Buffer.from(event.awslogs.data, 'base64')

    const logData = await unarchiveLogData(payload)

    await Promise.all(logData.logEvents.map(sendToPapertrail))
  } catch (error) {
    callback(error)
  }
}
