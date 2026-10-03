# Classical Synchronization I — Producer-Consumer Problem

This module visualizes the classic Producer-Consumer synchronization problem using semaphores, framed as an industrial rotary indexing carousel. The default sample data initializes an 8-slot buffer, with the Producer and Consumer operating at independent, slightly offset speeds (1.2s and 1.8s respectively). This offset practically guarantees contention over time, demonstrating the Empty, Full, and Mutex semaphores blocking and releasing in real-time as the processes compete for the central lock.
