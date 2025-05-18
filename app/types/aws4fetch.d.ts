declare module "aws4fetch" {
  export class AwsClient {
    constructor(options: {
      accessKeyId: string;
      secretAccessKey: string;
      sessionToken?: string;
      service?: string;
      region?: string;
    });

    sign(
      request: Request,
      options?: {
        aws?: {
          signQuery?: boolean;
          service?: string;
          region?: string;
        };
      }
    ): Promise<Request>;
  }
}
