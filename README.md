# aws-reboot

aws-reboot is a Node.js npm package that simplifies the process of rebooting EC2 instances associated with ECS container instances in a specified ECS cluster.

## Installation
Install the package globally using npm:

```bash
npm install -g aws-reboot
```

## Usage
Run the package using the following command:

```bash
aws-reboot <ecsClusterName> [instanceChunk]
```

- <ecsClusterName>: The name of your ECS cluster.
- [instanceChunk]: (Optional) Number of EC2 instances to reboot in each chunk. Default is 5.
### Example:

```bash
aws-reboot my-ecs-cluster 10
```

This command reboots EC2 instances associated with the specified ECS cluster (my-ecs-cluster) in chunks of 10 instances at a time.

## Configuration
The AWS region is determined based on the AWS CLI configuration or the AWS_REGION environment variable. If not set, the default region is 'us-east-1'.

## Contributing
Contributions are welcome! Please read the Contribution Guidelines before making a contribution.

## License
This project is licensed under the MIT License.

