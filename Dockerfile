FROM mhart/alpine-node:8

ADD node_modules/ node_modules/
ADD out/crawler.js out/crawler.js
VOLUME [ "./data" ]

CMD node out/crawler.js