#!/bin/bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install --legacy-peer-deps
npm install ajv@8.12.0 ajv-keywords@5.1.0 schema-utils@4.2.0 --legacy-peer-deps --save-dev
npx expo start --clear
