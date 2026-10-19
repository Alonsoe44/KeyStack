#!/bin/sh
# Stands in for amidi in AmidiTransport tests. Every call is appended to
# $FAKE_AMIDI_LOG. -d prints $FAKE_AMIDI_DUMP, then exits when
# $FAKE_AMIDI_UNPLUG is set (as amidi does when the device goes away) or
# waits to be killed.
echo "$*" >> "$FAKE_AMIDI_LOG"
case "$1" in
  -l)
    printf 'Dir Device    Name\n'
    [ -n "$FAKE_AMIDI_NO_DEVICE" ] || printf 'IO  hw:1,0,1  Launchkey Mini MK4 37 DAW Out\n'
    ;;
  -p)
    if [ "$3" = "-d" ]; then
      printf '%b' "$FAKE_AMIDI_DUMP"
      [ -n "$FAKE_AMIDI_UNPLUG" ] && exit 0
      while :; do sleep 1; done
    fi
    ;;
esac
