# postsound.deepanalve.dev: static site. Tokens, font and the popup and overlay styles come from the
# extension, so the site always shows the UI people get.
FROM nginx:1.29-alpine
COPY site/nginx.conf /etc/nginx/conf.d/default.conf
COPY site/ /usr/share/nginx/html/
COPY tokens.css popup.css content.css /usr/share/nginx/html/
COPY fonts/Geist-Variable.woff2 /usr/share/nginx/html/fonts/Geist-Variable.woff2
# Concepts are design drafts, not pages. Version every stylesheet and script link by content,
# so Cloudflare and browsers never serve an old copy.
RUN rm -rf /usr/share/nginx/html/nginx.conf /usr/share/nginx/html/concepts && cd /usr/share/nginx/html \
 && for f in *.css *.js; do h=$(md5sum "$f" | cut -c1-10); sed -i "s#\"/$f\"#\"/$f?v=$h\"#g" *.html; done
