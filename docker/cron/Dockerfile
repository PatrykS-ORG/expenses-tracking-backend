FROM alpine:3.21

RUN apk add --no-cache curl supercronic

COPY docker/cron/trigger-summary.sh /scripts/trigger-summary.sh
COPY docker/cron/crontab /etc/crontab

RUN chmod +x /scripts/trigger-summary.sh

CMD ["/usr/bin/supercronic", "/etc/crontab"]
