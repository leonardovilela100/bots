# Bots

## wppconnect-serve

This directory contains a small REST service that wraps the [wppconnect](https://github.com/wppconnect-team/wppconnect) library.

### Building the Docker image

```
docker build -t wppconnect-serve ./wppconnect-serve
```

### Running the container

```
docker run -p 3000:3000 wppconnect-serve
```

The server will start on port 3000 by default.
