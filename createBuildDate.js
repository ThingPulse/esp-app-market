const { writeFileSync } = require('fs')
const { join } = require('path')

const TIME_STAMP_PATH = join(__dirname, 'src/assets/buildDate.json');

const createBuildDate = {
    year: new Date()
}

writeFileSync(TIME_STAMP_PATH, JSON.stringify(createBuildDate, null, 2));