const { EC2, ECS } = require('aws-sdk');

const ec2 = new EC2();
const ecs = new ECS();

async function getContainerInstances(clusterName) {
    let nextToken;

    const result = new Set();
    console.info('Getting information about instances');
    do {
        const list = await ecs.listContainerInstances({ cluster: clusterName, nextToken }).promise();

        if (list.containerInstanceArns && list.containerInstanceArns.length) {
            list.containerInstanceArns.forEach(v => result.add(v));
        }

        nextToken = list.nextToken;

        console.info(`Container instances found: ${result.size}`);
    } while (nextToken);

    return Array.from(result);
}

async function getDescribeContainerInstances(cluster, arnList) {
    const result = [];
    const chunks = new Array(Math.ceil(arnList.length / 100)).fill().map(_ => arnList.splice(0, 100));

    console.info('Getting container instances description');
    for (const containerInstances of chunks) {
        const list = await ecs.describeContainerInstances({
            cluster,
            containerInstances,
        }).promise();

        result.push(...list.containerInstances);

        console.info(`Container instances descriptions found: ${result.length}`);
    }

    return result;
}

async function getEC2InstancesList(ecsClusterName) {
    const containerInstancesArn = await getContainerInstances(ecsClusterName);
    const descriptions = await getDescribeContainerInstances(ecsClusterName, Array.from(containerInstancesArn));
    const result = Array.from(new Set(descriptions.map(v => v.ec2InstanceId)));

    if (result.length === containerInstancesArn.length) {
        return result;
    }

    throw new Error(`Can't get information about ${containerInstancesArn.length - result.length} instances!`);
}

const init = async () => {
    const ecsClusterName = process.env.ECS_CLUSTER;
    const rebootInstancesStep = process.env.INSTANCE_CHUNK || 5;

    if (!ecsClusterName) {
        throw new Error('Initialization error');
    }

    const ec2InstancesList = await getEC2InstancesList(ecsClusterName);
    const selectedForRebootCount = ec2InstancesList.length;
    /**
     * @type {string[][]}
     */
    const chunks = new Array(Math.ceil(ec2InstancesList.length / rebootInstancesStep)).fill().map(_ => ec2InstancesList.splice(0, rebootInstancesStep));

    let counter = 0;
    const promises = [];
    for (const index in chunks) {
        promises.push(new Promise(resolve => {
            setTimeout(async () => {
                try {
                    const InstanceIds = chunks[index];
                    counter += InstanceIds.length;

                    console.info(`[${counter}/${selectedForRebootCount}]\tRebooting instances: ${InstanceIds.join(', ')}`);
                    await ec2.rebootInstances({ InstanceIds }).promise();
                } catch (error) {
                    console.error(`Can't reboot instances: ${chunks[index].join(', ')}`, error);
                } finally {
                    resolve();
                }
            }, index * 1000 * 90)
        }));
    }

    await Promise.all(promises);
    console.info(`Completed rebooting of ${selectedForRebootCount} instances`);
};

init().catch(error => console.error(error));
