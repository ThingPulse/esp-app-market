const { writeFileSync } = require('fs')
const { join } = require('path')

const ENV_PATH = join(__dirname, 'src/assets/environment.json');

const environment = {
    buildDate: new Date()
}

writeFileSync(ENV_PATH, JSON.stringify(environment, null, 2));