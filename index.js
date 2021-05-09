const zlib = require('zlib')
const winston = require('winston')
const { PapertrailTransport } = require('winston-papertrail-transport')

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

function getEnvVarOrFail(varName) {
  const value = process.env[varName]
  if (!value) {
    throw new Error(`Required environment variable ${varName} is undefined`)
  }
  return value
}

// Should match winston simple log format for example: "error: The database has exploded"
// For more information see https://github.com/winstonjs/winston
// The pattern represents the following:
// A sequence of non-tab chars at the start of input followed by a tab
// Another sequence of non-tabs followed by a tab
// Capture a group of alphanumeric chars leading up to a ':'
const logLevelRegex = /^[^\t]+\t[^\t]+\t(\w+):/
function parseLogLevel(tsvMessage) {
  // Messages logged manually are tab separated value strings of three columns:
  // date string (ISO8601), request ID, log message
  const match = logLevelRegex.exec(tsvMessage)
  return match && match[1].toLowerCase()
}

exports.handler = async (event, context, callback) => {
  try {
    const host = getEnvVarOrFail('PAPERTRAIL_HOST')
    const port = getEnvVarOrFail('PAPERTRAIL_PORT')

    const payload = Buffer.from(event.awslogs.data, 'base64')

    const logData = await unarchiveLogData(payload)

    const papertrailTransport = new PapertrailTransport({
      host,
      port,
    })

    const logger = winston.createLogger({
      transports: [papertrailTransport],
    })

    logData.logEvents.forEach((event) => {
      const logLevel = parseLogLevel(event.message) || 'info'

      logger.log(logLevel, event.message)
    })
    logger.end()
    
  } catch (error) {
    callback(error)
  }
}
