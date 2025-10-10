#!/usr/bin/env node

/**
 * Secure Docker Builder CLI
 * Generates secure Docker images for clients with embedded activation
 */

const { Command } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const fs = require('fs').promises;
const path = require('path');
const SecureImageBuilder = require('./image-builder');
const crypto = require('crypto');

const program = new Command();

// Banner
const showBanner = () => {
  console.clear();
  console.log(chalk.cyan(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║          LOGISTICS SECURE DOCKER BUILDER                  ║
║            Zero Source Code Distribution                  ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`));
};

program
  .name('logistics-secure-build')
  .description('Build secure Docker images for client deployment')
  .version('2.0.0');

/**
 * Build command - Create secure Docker image
 */
program
  .command('build')
  .description('Build a secure Docker image for a client')
  .option('-c, --config <path>', 'Configuration file path')
  .option('-i, --interactive', 'Interactive mode', true)
  .option('-o, --output <image>', 'Output image name')
  .option('--registry <url>', 'Docker registry URL')
  .option('--no-push', 'Skip pushing to registry')
  .action(async (options) => {
    showBanner();

    let config;

    if (options.config) {
      // Load from config file
      config = JSON.parse(await fs.readFile(options.config, 'utf8'));
    } else {
      // Interactive mode
      config = await getInteractiveConfig();
    }

    // Merge with command line options
    if (options.output) config.outputImage = options.output;
    if (options.registry) config.registry = options.registry;
    config.push = options.push !== false;

    // Build the image
    await buildSecureImage(config);
  });

/**
 * Generate command - Generate configuration
 */
program
  .command('generate-config')
  .description('Generate a configuration file for building')
  .option('-o, --output <path>', 'Output file path', './build-config.json')
  .action(async (options) => {
    showBanner();

    const config = await getInteractiveConfig();

    await fs.writeFile(
      options.output,
      JSON.stringify(config, null, 2)
    );

    console.log(chalk.green(`\n✓ Configuration saved to ${options.output}`));
  });

/**
 * Push command - Push image to registry
 */
program
  .command('push <image>')
  .description('Push secure image to registry')
  .option('--registry <url>', 'Registry URL')
  .option('--username <user>', 'Registry username')
  .option('--password <pass>', 'Registry password')
  .action(async (image, options) => {
    const spinner = ora('Pushing image to registry...').start();

    try {
      // Login to registry if credentials provided
      if (options.username && options.password) {
        await execAsync(`docker login ${options.registry || ''} -u ${options.username} -p ${options.password}`);
      }

      // Tag and push
      if (options.registry) {
        const taggedImage = `${options.registry}/${image}`;
        await execAsync(`docker tag ${image} ${taggedImage}`);
        await execAsync(`docker push ${taggedImage}`);
        spinner.succeed(chalk.green(`Image pushed: ${taggedImage}`));
      } else {
        await execAsync(`docker push ${image}`);
        spinner.succeed(chalk.green(`Image pushed: ${image}`));
      }

    } catch (error) {
      spinner.fail(chalk.red('Failed to push image'));
      console.error(error.message);
      process.exit(1);
    }
  });

/**
 * Run command - Test run the secure image
 */
program
  .command('run <image>')
  .description('Test run a secure image locally')
  .option('-d, --detached', 'Run in detached mode')
  .action(async (image, options) => {
    console.log(chalk.cyan('\nStarting secure image locally...\n'));

    const runCommand = `docker run ${options.detached ? '-d' : '-it'} \
      --name logistics-test-${Date.now()} \
      -v /var/run/docker.sock:/var/run/docker.sock \
      -v logistics-data:/opt/logistics \
      -p 3000-3011:3000-3011 \
      --privileged \
      ${image}`;

    console.log(chalk.gray(`Running: ${runCommand}\n`));

    const { exec } = require('child_process');
    exec(runCommand, (error, stdout, stderr) => {
      if (error) {
        console.error(chalk.red('Error:'), error.message);
        return;
      }
      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);
    });
  });

/**
 * Get interactive configuration
 */
async function getInteractiveConfig() {
  console.log(chalk.cyan('\n🔧 Secure Image Configuration\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'clientId',
      message: 'Client ID (UUID):',
      validate: (input) => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(input) || 'Please enter a valid UUID';
      }
    },
    {
      type: 'input',
      name: 'clientName',
      message: 'Client Name:',
      validate: (input) => input.length > 0 || 'Client name is required'
    },
    {
      type: 'list',
      name: 'licenseType',
      message: 'License Type:',
      choices: [
        { name: 'Trial (14 days)', value: 'TRIAL' },
        { name: 'Standard (Monthly)', value: 'STANDARD' },
        { name: 'Professional (Monthly)', value: 'PROFESSIONAL' },
        { name: 'Enterprise (Annual)', value: 'ENTERPRISE' }
      ]
    },
    {
      type: 'input',
      name: 'registry',
      message: 'Docker Registry URL:',
      default: 'docker.io/sayansr26/logistics-secure-client'
    },
    {
      type: 'input',
      name: 'licenseServer',
      message: 'License Server URL:',
      default: 'http://localhost:3011'
    },
    {
      type: 'confirm',
      name: 'enableMonitoring',
      message: 'Enable monitoring and analytics?',
      default: false
    }
  ]);

  // All production services (exclude license-service and internal tools)
  const allProductionServices = [
    'frontend',
    'api-gateway',
    'auth-service',
    'user-service',
    'shipment-service',
    'partner-service',
    'wallet-service',
    'support-service',
    'platform-service'
  ];

  // Generate secure keys
  const secretKey = crypto.randomBytes(32).toString('hex');
  const tag = `${answers.clientName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

  console.log(chalk.cyan('\n📦 Services included in build:'));
  allProductionServices.forEach(service => {
    console.log(chalk.gray(`  ✓ ${service}`));
  });
  console.log(chalk.gray('\n  Excluded: license-service (internal only)'));
  console.log(chalk.gray('  Excluded: tools/ scripts/ (internal only)\n'));

  return {
    clientId: answers.clientId,
    clientName: answers.clientName,
    services: allProductionServices,
    licenseType: answers.licenseType,
    registry: answers.registry,
    licenseServer: answers.licenseServer,
    enableMonitoring: answers.enableMonitoring,
    secretKey,
    tag,
    outputImage: `logistics/secure-${answers.clientId}:${tag}`,
    timestamp: new Date().toISOString()
  };
}

/**
 * Build secure image
 */
async function buildSecureImage(config) {
  console.log(chalk.cyan('\n🔨 Building Secure Docker Image\n'));

  console.log('Configuration:');
  console.log(`  Client: ${config.clientName}`);
  console.log(`  Services: ${config.services.join(', ')}`);
  console.log(`  License Type: ${config.licenseType}`);
  console.log(`  Output: ${config.outputImage}`);
  console.log();

  const builder = new SecureImageBuilder(config);

  try {
    const result = await builder.build();

    console.log(chalk.green('\n✅ Build Complete!\n'));
    console.log('Image Details:');
    console.log(`  Name: ${result.imageName}`);
    console.log(`  Size: ${result.size}`);
    console.log(`  Registry: ${result.registry}`);

    // Calculate the pushed image name for client deployment
    let deploymentImageName = result.imageName;

    if (config.push) {
      console.log(chalk.cyan('\n📤 Pushing to registry...\n'));
      const pushedImageName = await pushToRegistry(result.imageName, config.registry, result.buildDir);
      if (pushedImageName) {
        deploymentImageName = pushedImageName;
      }
    }

    // Clean up build directory after push
    if (result.buildDir) {
      await fs.rm(result.buildDir, { recursive: true, force: true });
    }

    // Generate deployment instructions
    await generateInstructions(config, result, deploymentImageName);

    console.log(chalk.cyan('\n📋 Client Deployment Instructions:\n'));
    console.log('1. Pull the image:');
    console.log(chalk.gray(`   docker pull ${deploymentImageName}`));
    console.log('\n2. Run the deployment:');
    console.log(chalk.gray(`   docker run -it \\
     --name logistics-platform \\
     -v /var/run/docker.sock:/var/run/docker.sock \\
     -v logistics-data:/opt/logistics \\
     -p 3000-3011:3000-3011 \\
     --privileged \\
     ${deploymentImageName}`));
    console.log('\n3. Follow the activation prompts');
    console.log('\n4. Access the platform:');
    console.log('   Frontend: http://localhost:3000');
    console.log('   API: http://localhost:3001');

    // Save image reference
    const imageRef = {
      clientId: config.clientId,
      clientName: config.clientName,
      imageName: result.imageName,
      services: config.services,
      licenseType: config.licenseType,
      builtAt: new Date().toISOString(),
      size: result.size
    };

    await fs.writeFile(
      path.join(process.cwd(), `${config.clientId}-image.json`),
      JSON.stringify(imageRef, null, 2)
    );

    console.log(chalk.green(`\n✓ Image reference saved: ${config.clientId}-image.json`));

  } catch (error) {
    console.error(chalk.red('\n✗ Build failed:'), error.message);
    process.exit(1);
  }
}

/**
 * Push image to registry
 */
async function pushToRegistry(imageName, registry, buildDir) {
  const { promisify } = require('util');
  const exec = promisify(require('child_process').exec);

  try {
    // Parse the image name to get tag
    const [, tag] = imageName.split(':');

    // Construct proper registry image name
    // registry format can be:
    // - "username" -> docker.io/username/IMAGE:TAG
    // - "docker.io/username/imagename" -> use as is with :TAG
    // - "registry.example.com/username" -> registry.example.com/username/IMAGE:TAG

    let fullImageName;

    if (registry.includes('/')) {
      // Registry already includes path (e.g., "sayansr26/logistics-secure-client" or "docker.io/sayansr26/logistics-secure-client")
      fullImageName = `${registry}:${tag}`;
    } else {
      // Just username (e.g., "sayansr26")
      fullImageName = `${registry}/logistics-secure-client:${tag}`;
    }

    // Check if buildx is available for multi-platform builds
    try {
      await exec('docker buildx version');
      console.log(chalk.gray(`  Creating multi-platform image for linux/amd64 and linux/arm64...`));

      // Use existing multiplatform builder or create if doesn't exist
      try {
        await exec('docker buildx use multiplatform');
      } catch {
        // Builder doesn't exist, create it
        await exec('docker buildx create --name multiplatform --use');
      }

      // Build and push multi-platform image using buildx from the original Dockerfile
      console.log(chalk.gray(`  Building and pushing multi-platform image...`));
      await exec(`cd ${buildDir} && docker buildx build \
        -f Dockerfile.deployment \
        --platform linux/amd64,linux/arm64 \
        --tag ${fullImageName} \
        --push \
        .`);

      console.log(chalk.green(`✓ Multi-platform image pushed to registry: ${fullImageName}`));
      console.log(chalk.gray(`  Platforms: linux/amd64, linux/arm64`));
    } catch (buildxError) {
      // Fallback to regular tag and push (single platform)
      console.log(chalk.yellow(`  ⚠ Buildx build failed: ${buildxError.message}`));
      console.log(chalk.yellow(`  ⚠ Falling back to single-platform image...`));
      console.log(chalk.gray(`  Tagging: ${imageName} -> ${fullImageName}`));
      await exec(`docker tag ${imageName} ${fullImageName}`);

      console.log(chalk.gray(`  Pushing: ${fullImageName}`));
      await exec(`docker push ${fullImageName}`);

      console.log(chalk.green(`✓ Image pushed to registry: ${fullImageName}`));
      console.log(chalk.yellow(`  ⚠ Single platform only - may not work on all architectures`));
    }

    // Return the pushed image name so it can be used in deployment instructions
    return fullImageName;
  } catch (error) {
    console.error(chalk.yellow('⚠ Failed to push to registry:'), error.message);
    console.log('You can push manually later using:');
    console.log(chalk.gray(`docker push ${imageName}`));
    return null;
  }
}

/**
 * Generate deployment instructions
 */
async function generateInstructions(config, result, deploymentImageName) {
  const instructions = `# Logistics Platform - Secure Deployment

## Client Information
- Client ID: ${config.clientId}
- Client Name: ${config.clientName}
- License Type: ${config.licenseType}
- Services: ${config.services.join(', ')}

## Docker Image
- Image: ${deploymentImageName || result.imageName}
- Size: ${result.size}
- Registry: ${result.registry}

## Deployment Instructions

### Prerequisites
- Docker 20.10+ installed
- 8GB RAM minimum
- 50GB disk space
- Internet connection for activation

### Deployment Steps

1. **Pull the Docker image**
   \`\`\`bash
   docker pull ${deploymentImageName || result.imageName}
   \`\`\`

2. **Run the deployment**
   \`\`\`bash
   docker run -it \\
     --name logistics-platform \\
     -v /var/run/docker.sock:/var/run/docker.sock \\
     -v logistics-data:/opt/logistics \\
     -p 3000-3011:3000-3011 \\
     --privileged \\
     ${deploymentImageName || result.imageName}
   \`\`\`

3. **Follow the activation prompts**
   - Enter your license key when prompted
   - Provide company email
   - Set admin password
   - Confirm deployment

4. **Access the platform**
   - Frontend: http://localhost:3000
   - API Gateway: http://localhost:3001
   - Admin login with configured credentials

### Management Commands

**View logs:**
\`\`\`bash
docker logs logistics-platform
\`\`\`

**Stop platform:**
\`\`\`bash
docker stop logistics-platform
\`\`\`

**Restart platform:**
\`\`\`bash
docker start logistics-platform
\`\`\`

**Remove platform:**
\`\`\`bash
docker rm -f logistics-platform
docker volume rm logistics-data  # WARNING: Deletes all data
\`\`\`

### Troubleshooting

**License issues:**
- Ensure your license key is valid
- Check internet connectivity
- Verify system time is correct

**Port conflicts:**
- Check if ports 3000-3011 are available
- Use different ports with -p flag if needed

**Docker issues:**
- Ensure Docker daemon is running
- Check Docker version: docker --version
- Verify Docker socket access

### Support
- Documentation: https://docs.logistics.com
- Support: support@logistics.com
- Client ID: ${config.clientId}

Generated: ${new Date().toISOString()}
`;

  await fs.writeFile(
    path.join(process.cwd(), `${config.clientId}-instructions.md`),
    instructions
  );
}

// Parse arguments
program.parse(process.argv);

// Show help if no command
if (!process.argv.slice(2).length) {
  program.outputHelp();
}