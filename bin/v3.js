const { ECSClient, paginateDescribeContainerInstances } = require('@aws-sdk/client-ecs');
const { EC2Client, RebootInstancesCommand } = require('@aws-sdk/client-ec2');

const ecs = new ECSClient();
const ec2 = new EC2Client();

async function getContainerInstances(clusterName) {
    let nextToken;

    const result = new Set();
    console.info('Getting information about instances');
    do {
        const list = await ecs.send(new ListContainerInstancesCommand({ cluster: clusterName, nextToken }));
        if (list.containerInstanceArns && list.containerInstanceArns.length) {
            list.containerInstanceArns.forEach(v => result.add(v));
        }

        nextToken = list.nextToken

        console.info(`Container instances found: ${result.size}`);
    } while (nextToken);

    return Array.from(result);
}

async function getDescribeContainerInstances(cluster, arnList) {
    const result = [];
    const chunks = new Array(Math.ceil(arnList.length / 100)).fill().map(_ => arnList.splice(0, 100));

    console.info('Getting container instances description');
    for (const containerInstances of chunks) {
        const list = await paginateDescribeContainerInstances({ client: ecs, cluster, containerInstances });
        results.push(...list.containerInstances);

        console.info(`Container instances descriptions found: ${result.length}`);
    }

    return result;
}

async function getEC2InstancesList(ecsClusterName) {
    const containerInstanceArn = await getContainerInstances(ecsClusterName);
    const descriptions = await getDescribeContainerInstances(ecsClusterName, Array.from(containerInstanceArn));
    const result = Array.from(new Set(descriptions.map(v => v.ec2InstanceId)));

    if (result.length !== containerInstanceArn.length) {
        throw new Error(`Can't get information about ${containerInstanceArn.length - result.length} instances!`);
    }

    return result;
}

const init = async () => {
    const [,, ...args] = process.argv;
    const [ecsClusterName, instanceChunk] = args;
    const rebootIntancesStep = instanceChunk || 5;

    if (!ecsClusterName) {
        throw new Error('Initialization error, please provide a cluster name');
    }

    const ec2InstanceList = await getEC2InstancesList(ecsClusterName);
    const selectedForRebootCount = ec2InstanceList.length;

    const chunks = new Array(Math.ceil(ec2InstanceList.length / rebootIntancesStep)).fill().map(_ => ec2InstanceList.splice(0, rebootIntancesStep));

    let counter = 0;
    const promises = [];
    for (const index in chunks) {
        promises.push(new Promise(resolve => {
            setTimeout(async () => {
                try {
                    const instanceIds = chunks[index];
                    counter += instanceIds.length;

                    console.info(`[${counter}/${selectedForRebootCount}]\tRebooting instances: ${instanceIds.join(', ')}`);
                    await ec2.send(new RebootInstancesCommand({ instanceIds }));
                } catch (error) {
                    console.error(`Can't reboot instances: ${chunks[index].join(', ')}`);
                } finally {
                    resolve();
                }
            }, index * 1000 * 90);
        }))
    }

    await Promise.all(promises);
    console.info(`Completed rebooting of ${selectedForRebootCount} instances`);
}

init().catch(error => console.error(error));
