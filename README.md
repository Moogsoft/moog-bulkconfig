![Moogsoft Logo](https://www.moogsoft.com/wp-content/uploads/2017/02/moog-logo.png)

## Moogsoft Express bulk config change utility

Leverages the Config API service to make bulk changes, using regex search capability

The utility:

* Queries the configuration for artifacts that match a regular expression
* Applies further (optional) conditions
* Applies changes to all matching configs

# Installation

`$ npm install moog-bulkconfig`

`$ npm link moog-bulkconfig`

## Usage

```
express-bulkconfig [-d] [-y] [-j] [-l debug] [-c config_file] [-h]
    --dryrun:            Show what changes would be made, but don't do it.
    --yaml:              Dump the entire seach results as a YAML file. (saved.yaml)
    --json:              Dump the entire seach results as a JSON file. (saved.json)
    --loglevel debug:    Be more verbose
    --conf config_file:  Specifiy a config file (default is ./mbc-config.yaml)
    --help:              The usage message
```

# The config file

```JavaScript

---
apikey: 'foo_12345667890ljyg76dcOGYSJYGY7bhd7VB7vbfGHjyggy' 

owner: 'acme.*EC2:'

patchquery:
  when:
    sigma: 4
    holdfor: 1
  then:
    sigma: 8
```

In the above example, all configutions where the `owner` key includes the string `acme` and also contains the string `EC2:` will be checked.

If the configurations also have the `sigma` value 4, and `holdfor` 1, than the `sigma` value will be set to 8.

See the API documenation for further information.
