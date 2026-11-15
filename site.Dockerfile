# postsound.deepanalve.dev: static site. Tokens and font come from the extension, so they never drift.
FROM nginx:1.29-alpine
COPY site/nginx.conf /etc/nginx/conf.d/default.conf
COPY site/ /usr/share/nginx/html/
COPY tokens.css /usr/share/nginx/html/tokens.css
COPY fonts/Geist-Variable.woff2 /usr/share/nginx/html/fonts/Geist-Variable.woff2
RUN rm /usr/share/nginx/html/nginx.conf
