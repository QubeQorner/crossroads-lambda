import * as cdk from '@aws-cdk/core';
import s3 = require('@aws-cdk/aws-s3');
import codepipeline = require('@aws-cdk/aws-codepipeline');
import codepipeline_actions = require('@aws-cdk/aws-codepipeline-actions');
import codebuild = require('@aws-cdk/aws-codebuild');
import {SecretValue} from "@aws-cdk/core";

export class PipelineStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    const artifactsBucket = new s3.Bucket(this, "CrossroadsArtifactsBucket");

    const pipeline = new codepipeline.Pipeline(this, 'CrossroadsPipeline', {
      artifactBucket: artifactsBucket
    });

    const sourceOutput = new codepipeline.Artifact();

    pipeline.addStage({
      stageName: 'Source',
      actions: [
          new codepipeline_actions.GitHubSourceAction({
            actionName: 'Checkout',
            output: sourceOutput,
            owner: 'QubeQorner',
            repo: 'crossroads-lambda',
            branch: 'main',
            oauthToken: SecretValue.secretsManager('arn:aws:secretsmanager:eu-central-1:597880501761:secret:github-token-8Ehk8E'),
            trigger: codepipeline_actions.GitHubTrigger.WEBHOOK
          })
      ]
    });

    const buildOutput = new codepipeline.Artifact();

    // Declare a new CodeBuild project
    const buildProject = new codebuild.PipelineProject(this, 'Build', {
      environment: { buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_2 },
      environmentVariables: {
        'PACKAGE_BUCKET': {
          value: artifactsBucket.bucketName
        }
      }
    });

    // Add the build stage to our pipeline
    pipeline.addStage({
      stageName: 'Build',
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: 'Build',
          project: buildProject,
          input: sourceOutput,
          outputs: [buildOutput],
        }),
      ],
    });

    // Add the Deploy stage to our pipeline
    pipeline.addStage({
      stageName: 'Prod',
      actions: [
        new codepipeline_actions.CloudFormationCreateReplaceChangeSetAction({
          actionName: 'CreateChangeSet',
          templatePath: buildOutput.atPath("packaged.yaml"),
          stackName: 'crossroads-stack',
          adminPermissions: true,
          changeSetName: 'crossroads-prod-changeset',
          runOrder: 1
        }),
        new codepipeline_actions.CloudFormationExecuteChangeSetAction({
          actionName: 'Deploy',
          stackName: 'crossroads-stack',
          changeSetName: 'crossroads-prod-changeset',
          runOrder: 2
        }),
      ]
    })
  }
}
