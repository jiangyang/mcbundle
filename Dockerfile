FROM node:6
RUN groupadd --system nightmare && useradd --system --create-home --gid nightmare nightmare
ENV HOME "/home/nightmare"
# ENV DEBUG=nightmare
ENV ARGUMENTS=()

RUN apt-get update && apt-get install -y \
  xvfb \
  x11-xkb-utils \
  xfonts-100dpi \
  xfonts-75dpi \
  xfonts-scalable \
  xfonts-cyrillic \
  x11-apps \
  clang \
  libdbus-1-dev \
  libgtk2.0-dev \
  libnotify-dev \
  libgnome-keyring-dev \
  libgconf2-dev \
  libasound2-dev \
  libcap-dev \
  libcups2-dev \
  libxtst-dev \
  libxss1 \
  libnss3-dev \
  gcc-multilib \
  g++-multilib && \
    rm -rf /var/lib/apt/lists/* && \
    find /usr/share/doc -depth -type f ! -name copyright | xargs rm || true && \
    find /usr/share/doc -empty | xargs rmdir || true && \
    rm -rf /usr/share/man/* /usr/share/groff/* /usr/share/info/* && \
    rm -rf /usr/share/lintian/* /usr/share/linda/* /var/cache/man/*

WORKDIR ${HOME}
ADD ./package.json ./mcbundle/
ADD ./*.js ./mcbundle/
WORKDIR ${HOME}/mcbundle
RUN npm install

ENV USER 'mcbundle@mcbundle.bundle'
ENV PASS 'woulditwork?'
ENV SLACK_BOT_TOKEN 'nope'
ENV SLACK_BOT_ID 'nope'
ENV SLACK_TEAM_ID 'nope'

CMD xvfb-run node index.js