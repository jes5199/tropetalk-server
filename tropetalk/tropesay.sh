#!/bin/sh
export DISPLAY=:7
cd "$(dirname "$0")"
wine ./tropesay.exe $1
