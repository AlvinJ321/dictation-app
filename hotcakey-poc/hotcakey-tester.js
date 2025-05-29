import hotcakey from 'hotcakey';
import process from 'node:process';

async function main() {
    try {
        console.log('Attempting to activate hotcakey...');
        await hotcakey.activate();
        console.log('hotcakey activated successfully.');

        const keyToTest = 'Space'; // We use Space because we know it works
        console.log(`Attempting to register '${keyToTest}' to diagnose other keys.`);

        // Register 'Space' key - we know this works.
        // The goal is to press Right Option *while* this event is also firing or just before/after
        // to see if its details appear in any raw event data.
        hotcakey.register([keyToTest], (event) => {
            console.log(`------------ DIAGNOSTIC EVENT (${keyToTest} pressed) ------------`);
            console.log("EVENT OBJECT:", JSON.stringify(event, null, 2));

            // Log specific properties we expect based on standard KeyboardEvent
            console.log(`event.key: ${event.key}`);
            console.log(`event.code: ${event.code}`);
            console.log(`event.altKey: ${event.altKey}`);
            console.log(`event.ctrlKey: ${event.ctrlKey}`);
            console.log(`event.metaKey: ${event.metaKey}`); // Command key on Mac
            console.log(`event.shiftKey: ${event.shiftKey}`);
            console.log(`event.type: ${event.type}`); // keydown or keyup
            console.log(`event.time: ${event.time}`); // timestamp

            // For hotcakey, the actual key that triggered this specific handler might be in a different property
            // if 'event' is a wrapper. The JSON.stringify above should reveal all properties.
            // If hotcakey provides raw keycodes or platform-specific codes, they would be in the stringified object.

            console.log("----------------------------------------------------");

            if (event.type === 'keydown') {
                console.log(`>> '${keyToTest}' key pressed`);
            } else if (event.type === 'keyup') {
                console.log(`>> '${keyToTest}' key released`);
            }
        });

        console.log(`Successfully registered '${keyToTest}' key listener.`);
        console.log(`NOW, PRESS YOUR '${keyToTest.toUpperCase()}' KEY REPEATEDLY.`);
        console.log(`WHILE DOING THAT, ALSO PRESS AND HOLD YOUR RIGHT OPTION KEY.`);
        console.log("LOOK CLOSELY AT THE 'EVENT OBJECT' LOGGED EACH TIME SPACE IS PRESSED.");
        console.log("We are looking for properties in the EVENT OBJECT that change when Right Option is held,");
        console.log("or any property that might indicate 'AltRight' or a specific key code for Right Option.");
        console.log('Press Ctrl+C in the terminal to stop.');

    } catch (error) {
        console.error('Error during hotcakey setup or registration:', error);
        process.exit(1);
    }
}

main().catch(err => {
    console.error("Unhandled error in main execution:", err);
    process.exit(1);
});

const keepAliveInterval = setInterval(() => {}, 1000 * 60 * 60);
process.on('SIGINT', () => {
    console.log('\nCtrl+C pressed. Exiting gracefully...');
    clearInterval(keepAliveInterval);
    console.log('Exited.');
    process.exit(0);
});