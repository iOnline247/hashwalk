#!/usr/bin/env node
import process from 'node:process';

import { main } from '../lib/cli.js';

main().then((code) => process.exit(code));
