#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { PipelineStack } from '../lib/pipeline-stack';

if (!process.env.GITHUB_TOKEN) {
    console.log("No Github Token present");
}

const app = new cdk.App();
new PipelineStack(app, 'crossroads-ci-cd');
