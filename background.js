
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request instanceof Array) {
        chrome.storage.sync.set({'enableSync': true}, function() {
            doSync(request);
        });
    }

	// Listener must always return true
	return true;
});

// AUTHENTICATION

// FETCH
async function doSync(sessions) {
	chrome.identity.getAuthToken({
		interactive: true
	}, function (token) {

		let calendarsOptions = {
			method: 'GET',
			async: true,
			headers: {
				Authorization: 'Bearer ' + token,
				'Content-Type': 'application/json'
			},
			'contentType': 'json'
		};

		fetch(
			'https://www.googleapis.com/calendar/v3/users/me/calendarList',
			calendarsOptions)
		.then((response) => response.json())
		.then((data) => {
			for (var i = 0; i < data.items.length; i++) {
				if (data.items[i].summary === "MyTutor Bookings") {
					// Calendar exists
					window.calendarID = data.items[i].id;

					let init = {
						method: 'GET',
						async: true,
						headers: {
							Authorization: 'Bearer ' + token,
							'Content-Type': 'application/json'
						},
						'contentType': 'json'
					};

					fetch(
						'https://www.googleapis.com/calendar/v3/calendars/' + window.calendarID + '/events',
						init)
					.then((response) => response.json())
					.then(function (data) {
						// Processing finished
						console.log(data);
						compareEvents(data, window.calendarID, sessions);
						//sendResponse(data);
					});

					// DONE
					return true;
				}
			}

			// IE no calendar exists
			var payload_calendar = {
				summary: "MyTutor Bookings"
			};

			var createCalendarObject = {
				method: "POST",
				async: true,
				headers: {
					Authorization: 'Bearer ' + token,
					'Content-Type': 'application/json',

				},
				body: JSON.stringify(payload_calendar)
			}

			fetch(
				'https://www.googleapis.com/calendar/v3/calendars',
				createCalendarObject)
			.then((response) => response.json())
			.then(function (data) {
				// Processing finished
				console.log(data);
				window.calendarID = data.id;
                compareEvents(data, data.id, sessions);
			});
		});

	});
}

// LOGIC
var settings = new Object();
settings.overwrite = true;

function compareEvents(events, calendarID, sessions) {
    for (let j = 0; j < sessions.length; j++) {

	    var matching_session = false;

	    if (events.items == null) {
            createEvent(sessions[j]);
            continue;
        }

        for (let i = 0; i < events.items.length; i++) {

            if (events.items[i].start.dateTime == sessions[j].startTime){
                if (events.items[i].summary != sessions[j].fullTitle) {
                    console.log("Found Existing Event with non-matching title: " + sessions[j].fullTitle);

                    if (settings.overwrite) {
                        // MyTutor takes priority
                        deleteEvent(events.items[i].id);
                        break;
                    } else {
                        console.log("Skipping overwrite due to settings.");
                        matching_session = true;
                        break;
                    }

                } else {
                    console.log("Found Existing Event: " + sessions[j].fullTitle);
                    matching_session = true;
                    break;
                }

            }
        }

        if (!matching_session) {
	        // Add new event (always called if match is false)
            createEvent(sessions[j]);
        }


	}

    chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
        chrome.tabs.sendMessage(tabs[0].id, {action: "finished_sync"}, function(response) {});
    });
}

// UTILS
function createEvent(session) {
    chrome.identity.getAuthToken({
        interactive: true
    }, function (token) {
        var event_payload = {
            start: {
                dateTime: session.startTime
            },
            end: {
                dateTime: session.endTime
            },
            summary: session.fullTitle
        }

        var createEvent = {
            method: "POST",
            async: true,
            headers: {
                Authorization: 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(event_payload)
        }

        fetch(
            'https://www.googleapis.com/calendar/v3/calendars/'+window.calendarID+'/events',
            createEvent);
    });
}

function deleteEvent(eventID) {
    chrome.identity.getAuthToken({
        interactive: true
    }, function (token) {
        // IE no calendar exists
        var deleteEvent = {
            method: "DELETE",
            async: true,
            headers: {
                Authorization: 'Bearer ' + token,
                'Content-Type': 'application/json',
            }
        }

        fetch(
            'https://www.googleapis.com/calendar/v3/calendars/'+window.calendarID+'/events/'+eventID,
            deleteEvent);
    });
}