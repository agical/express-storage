# ExpressStorage

A ligthweight, hacky proof-of-concept Unhosted storage provider, based on Node.js

## Fork
This is a fork of http://github.com/5apps/express-storage


Changes include but are not necessarily limited to:
- Removed redis dependency in favor of an in memory solution for easier testing
- Introduced a HTTP _backdoor_ to manipulate the store while testing

## Getting Started

    npm install
    cp copy_to_parent_dir_as_config.js ../config.js
    sudo node server.js

## Documentation

### HTTP Interface

In order to inspect the running, local stores in memory contents, use the following URLs:

__GET__ http://localhost/storage 

_A complete dump of the memory storage, as JSON_


__GET__ http://localhost/storage/key 

_Dump the contents under "key" as JSON_


__PUT__ http://localhost/storage/key 

_Replace (or insert anew) any data mapped under "key"_

## Examples
_(Coming soon)_

## Contributing
_(Coming soon)_

## Release History
_(Nothing yet)_

## License
Copyright (c) 2012 Michiel De Jong, Sebastian Kippe, Garret Alfert
Licensed under the MIT license.
