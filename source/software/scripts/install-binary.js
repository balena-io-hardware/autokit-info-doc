#!/usr/bin/env node

'use strict'

const binBuild = require('bin-build')
const path = require('path')
const decompress = require('decompress');
const fs = require('fs')
const download = require('download')

const platform = process.platform
const arch = process.arch

const UHUBCTL_INFO = {
  name: 'uhubctl',
  url: 'https://github.com/balena-io-playground/balena-fin-uhubctl/releases/download',
  source_url: 'https://github.com/mvp/uhubctl/archive/refs/tags',
  version: 'v2.4.0'
}

const OUTPUT_DIR = path.join(__dirname, '..', 'bin')
const MODULE_OUTPUT_DIR = path.join(__dirname, '..', 'build','/','bin')

const fileExist = (path) => {
  try {
    return fs.existsSync(path)
  } catch (err) {
    return false
  }
}

if (fileExist(path.join(OUTPUT_DIR, UHUBCTL_INFO.name)) && fileExist(path.join(MODULE_OUTPUT_DIR, UHUBCTL_INFO.name))) {
  console.log(path.join(__dirname, '..', 'bin', 'uhubctl'))
  console.log('uhubctl is already installed')
  process.exit(0)
}

if (process.env.SKIP_INSTALL_BINARY === 'true') {
  console.log('testbot sdk is skipping the download of uhubctl binary')
  process.exit(0)
}

// if platform is missing, download source instead of executable
const DOWNLOAD_MAP = {
  linux: {
    arm: 'usr/src/app/uhubctl/uhubctl',
  }
}

if (arch in DOWNLOAD_MAP[platform]) {
  // download the executable

  const filename = DOWNLOAD_MAP[platform][arch]
  const url = `${UHUBCTL_INFO.url}/${UHUBCTL_INFO.version}/uhubctl-${UHUBCTL_INFO.version}.tar.gz`

  console.log(`Downloading uhubctl from ${url}`)
  download(url, OUTPUT_DIR)
    .then(() => {
        decompress(`${OUTPUT_DIR}/uhubctl-${UHUBCTL_INFO.version}.tar.gz`, `${OUTPUT_DIR}`)
            .then(files => {
                const distPath = path.join(OUTPUT_DIR, UHUBCTL_INFO.name)
                fs.renameSync(path.join(OUTPUT_DIR, filename), distPath)
                if (fileExist(distPath)) {
                    fs.chmodSync(distPath, 0o777)
                }
                if (!fs.existsSync(MODULE_OUTPUT_DIR)){
                    fs.mkdirSync(MODULE_OUTPUT_DIR);
                }
                fs.copyFileSync(distPath, `${MODULE_OUTPUT_DIR}/uhubctl`);
                console.log(`Downloaded in ${OUTPUT_DIR}`)
            })
            .then(() => {
                fs.unlinkSync(`${OUTPUT_DIR}/uhubctl-${UHUBCTL_INFO.version}.tar.gz`);
                fs.rmdirSync(`${OUTPUT_DIR}/usr`, { recursive: true });
            });
    })
    .catch(err => {
      console.error(err)
      process.exit(1)
    })
} 
else { 
  // download source and build
  const url = `${UHUBCTL_INFO.source_url}/${UHUBCTL_INFO.version}.tar.gz`

  console.log(`Building uhubctl from ${url}`)
  binBuild
    .url(url, [
      `make`,
      `mkdir -p ${OUTPUT_DIR} && mkdir -p ${MODULE_OUTPUT_DIR}`,
      `cp uhubctl ${OUTPUT_DIR}/uhubctl`,
      `cp uhubctl ${MODULE_OUTPUT_DIR}/uhubctl`,
    ])
    .then(() => {
      console.log(`uhubctl installed successfully on ${OUTPUT_DIR}/uhubctl && ${MODULE_OUTPUT_DIR}/uhubctl`)
    })
    .catch(err => {
      console.error(`${err} - Ensure libusb-1.0 is installed.`)
      process.exit(1)
    })
}