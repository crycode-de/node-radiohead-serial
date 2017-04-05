/*
 * Node.js RadioHead Serial
 *
 * Functions for simulation Arduino things for RadioHead.
 * Parts taken from RadioHead tools.
 */

#include <unistd.h>
#include <iostream>
#include <sys/time.h>

#include "functions.h"

// Millis at the start of the process
unsigned long start_millis;

// Returns milliseconds since beginning of day
unsigned long time_in_millis()
{
    struct timeval te;
    gettimeofday(&te, NULL); // get current time
    unsigned long milliseconds = te.tv_sec*1000LL + te.tv_usec/1000; // caclulate milliseconds
    return milliseconds;
}

void delay(unsigned long ms)
{
    usleep(ms * 1000);
}

// Arduino equivalent, milliseconds since process start
unsigned long millis()
{
    return time_in_millis() - start_millis;
}

long random(long from, long to)
{
    return from + (random() % (to - from));
}

long random(long to)
{
    return random(0, to);
}
