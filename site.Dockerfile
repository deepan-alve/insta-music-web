# postsound.deepanalve.dev: static site. Tokens and font come from the extension, so they never drift.
FROM nginx:1.29-alpine
COPY site/nginx.conf /etc/nginx/conf.d/default.conf
COPY site/ /usr/share/nginx/html/
COPY tokens.css /usr/share/nginx/html/tokens.css
COPY fonts/Geist-Variable.woff2 /usr/share/nginx/html/fonts/Geist-Variable.woff2
# Version the stylesheet links by content, so Cloudflare and browsers never serve an old copy.
RUN rm /usr/share/nginx/html/nginx.conf && cd /usr/share/nginx/html \
 && T=$(md5sum tokens.css | cut -c1-10) && S=$(md5sum site.css | cut -c1-10) \
 && sed -i "s#href=\"/tokens.css\"#href=\"/tokens.css?v=$T\"#; s#href=\"/site.css\"#href=\"/site.css?v=$S\"#" *.html
