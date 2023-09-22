import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import dotenv from "dotenv";

dotenv.config({
  path: ".env"
});

// replace those vars with in your `.env` file
const connection = new IORedis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  password: process.env.REDIS_PASS,
});

const queueName = 'rate-limit-test';
const queue = new Queue(queueName, {connection});

await queue.drain();
await queue.addBulk(
    Array.from({
        length: 2,
    }).map((_, idx) => ({
        name: "test-job",
        data: {
            idx
        },
        opts: {
            delay: idx * 5_000
        }
    }))
);

const worker = new Worker(
    queueName,
    async (job) => {
        console.log(job.data);
        await worker.rateLimit(60 * 1e3);
        throw Worker.RateLimitError();
    },
    // `concurrency` seems to be an issue if set it a bigger value such as 10 in this case
    // then 1st active job remains in active list and continue to retry even if the queue is being rate limited
    // and once the delayed job is time to run, it gets moved to active before getting moved back to waiting list
    // if set = 1, it works as expected
    // which is all active jobs should be moved to waiting list as the queue is rate limited
    { concurrency: 10, connection }
);

