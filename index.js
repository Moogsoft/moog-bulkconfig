#!/usr/bin/env node
/** **************************************************************************
 *
 *  Contents of file Copyright (c) Moogsoft Inc 2017-2020
 *
 *  Utility to make bulk config changes to an integration
 *
 *************************************************************************** */

'use strict';

const https = require('https');
const url = require('url');
const fs = require('fs');
const yaml = require('js-yaml');
const getopts = require('getopts');

const protocol = 'https';

const cliopts = getopts(process.argv.slice(2), {
    alias: {
        loglevel: 'l',
        dryrun: 'd',
        conf: 'c',
        yaml: 'y',
        json: 'j',
        help: 'h',
    },
    default: {
        loglevel: 'warn',
        dryrun: false,
        conf: './mbc-config.yaml',
        save: false,
    },
});

if (cliopts.help) {
    console.log('Usage: moog-bulkconfig [-d] [-s] [-y] [-l debug] [-c config_file] [-h]');
    process.exit(0);
}

if (!fs.existsSync(cliopts.conf)) {
    console.error(`ERROR: config file not found: ${cliopts.conf}`);
    process.exit(2);
}
const configfile = yaml.safeLoad(fs.readFileSync(cliopts.conf, 'utf8'));

//
// Pull secrets, search parameters, and patch parameters
//
const apikey = configfile.apikey ? configfile.apikey : null;
const owner = configfile.owner ? configfile.owner : 'NULLSEARCH';
const patchquery = configfile.patchquery ? configfile.patchquery : {};
const hostname = configfile.hostname ? configfile.hostname : 'api.moogsoft.ai';

const options = {
    headers: {
        apikey,
        'Content-Type': 'application/json',
    },
};

function debug(msg) {
    if (cliopts.loglevel === 'debug') console.log(msg);
}

//
// Define the query
//
const query = {
    owner,
    component: 'collector-metric-config',
    fuzzy: true,
    attributes: ['owner', 'detector'],
};

//
// Build the URI with query string
//
query.attributes = `["${query.attributes.join('","')}"]`;
const searchUrl = url.format({
    hostname,
    query,
    protocol,
    pathname: '/express/v1/config/search',
});

//
// Define PATCH options
//
const patchOpts = {
    hostname,
    headers: options.headers,
    method: 'PATCH',
    path: '/express/v1/config',
};

//
// Send a PATCH request to API
//
function patchConfig(pOpts, config) {
    console.log(`applying: ${JSON.stringify(config)}`);
    const request = https.request(pOpts, (res) => {
        const chunks = [];
        res.on('data', (chunk) => {
            chunks.push(chunk);
        });

        res.on('end', () => {
            const body = Buffer.concat(chunks);
            debug(body.toString());
        });
    });
    request.on('error', (error) => { console.log(error); process.exit(2); });

    request.write(JSON.stringify(config));

    request.end();
}

function saveYaml(saveObj) {
    fs.writeFileSync('saved.yaml', yaml.safeDump(saveObj));
}

function evalQuery(d, q) {
    if (q === {}) return true;
    let MATCH = true;
    Object.entries(q).forEach(([key, value]) => {
        if (d[key] !== value) {
            MATCH = false;
        }
    });
    return MATCH;
}

function changeConfig(d, q) {
    Object.entries(q).forEach(([key, value]) => {
        d[key] = value;
    });
}

//
// Process the output of our search
//
function processBody(body) {
    const resbody = JSON.parse(body);
    resbody.data.forEach((m) => {
        //
        // This is a good place to filter metrics
        //
        if (evalQuery(m.detector, patchquery.when)) {
            //
            // This is where you mutate the config
            //
            console.log(`Matching metric: owner: ${m.owner}`);
            console.log(`detector: ${JSON.stringify(m.detector)}`);
            changeConfig(m.detector, patchquery.then);

            //
            // Build the PATCH payload
            //
            const payload = {
                owner: m.owner,
                component: 'collector-metric-config',
                attributes: {
                    detector: m.detector,
                },
            };
            if (!cliopts.dryrun) patchConfig(patchOpts, payload);
        }
    });
    if (cliopts.yaml) saveYaml(resbody.data);
    if (cliopts.json) fs.writeFileSync('saved.json', JSON.stringify(resbody.data));
}

//
// Send a GET request to the search endpoint
//
function searchConfig(sUrl, sOpts) {
    console.log('==== Searching for metric configs ====');
    debug(query);
    debug(patchquery);
    https.get(sUrl, sOpts, (res) => {
        const accumulator = [];

        res.on('data', (d) => {
            accumulator.push(d);
        });
        res.on('end', () => {
            const fullbody = Buffer.concat(accumulator);
            const fbody = JSON.parse(JSON.stringify(fullbody));

            // Make sure there's data
            if (fbody.data.length > 0) {
                processBody(fullbody);
            } else {
                console.error('ERROR: no data returned');
                console.log('statusCode:', res.statusCode);
                console.log('headers:', res.headers);
            }
        });
    }).on('error', (e) => {
        console.error(e);
    });
}

searchConfig(searchUrl, options);
