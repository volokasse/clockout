import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { databaseOptions } from './database-options.js';

export default new DataSource(
    databaseOptions((key) => process.env[key])
);
