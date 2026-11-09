#!/bin/bash
echo "Fixing AEGIS GRC..."
rm -rf node_modules package-lock.json
npm cache clean --force
npm install --legacy-peer-deps
npx expo start --clear
