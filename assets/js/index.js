//YOUTUBE PLAYER VARS
var tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
//GLOBAL VARS
var player, xhr, filterUsernameBool = false, messages = [], videoId, shwoStatistics = false;
//CALLED AUTO WHEN THE YOUTUBE FRAME US READ
//CREATE FRAME WITH OPTIONS (HEIGHT AND WIDTH)
function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '390',
        width: '640',
    });
}
//CALLED WHEN THE USER CLOSE TH MODA
//STOP THE VIDEO AND CLEAR THE CHAT  MESSAGES
function stopVideo() {
    if (xhr) {
        xhr.abort()
    }
    player.stopVideo();
    $("#chatMessages").empty();
    if(shwoStatistics){
        statistics();
    }
    shwoStatistics = false;
    messages = [];
}
//CALLED WHEN THE USER CHOSE THE STREAM 
function joinStream(selectedVideoId, videoTitle) {
    //when join to new stream update  
    //the chat messages and search user name
    $("#chatMessages").empty();
    $('#username').val('');
    //make the user close the model just by click on close
    $("#myModal").modal({ backdrop: 'static', keyboard: false });

    //model header
    $('#modalHeader').text(function () {
        return videoTitle;
    });
    //sending request to server to get messages
    messages = [];
    getmessages(selectedVideoId, '');
    videoId = selectedVideoId;
    //play the video
    player.loadVideoById({ 'videoId': videoId });
}

//CALLED TO GET MESSAGES FROM THE SERVER USING AJAX
function getmessages(videoId, nextPageToken) {
    xhr = $.ajax({
        url: "liveChat",
        type: "get",
        data: {
            videoId: videoId,
            nextPageToken: nextPageToken
        },
        success: function (response) {
            messages = messages.concat(response['items']);
            //PUSH THE NEW MESSAGES TO HTML
            $.each(
                response['items'],
                function (intIndex, objValue) {
                    $('#chatMessages').append(
                        $("<div style='display:block'>" +
                            "<img height='24 width='24' class='img-circle' src=" + objValue['authorDetails']['profileImageUrl'] + "></img>" +
                            "<p class='usernameChat'>" + objValue['authorDetails']['displayName'] + "</p>" +
                            "<p style='display:inline'>&nbsp;" + objValue['snippet']['displayMessage'] + "</p></div>")
                    );
                }
            );
            //IF THE Statistics IS SHOWN THEN WE UPDATE THE PLOT
            if(shwoStatistics){
                plotChart();
            }
        },
        error: function (error) {
            //IF THE SERVER RETURN ERROR 500 THEN WE RESEND REQUEST
            //"The request was sent too soon after the previous one. 
            //This error occurs when API requests to retrieve messages are being sent more frequently 
            //than YouTubes refresh rates, which unnecessarily wastes bandwidth and quota
            if (error.status == 500) {
                messages = [];
                setTimeout(getmessages(videoId, ""), 50000);
            }
        },
        complete: function (resp) {
            // Schedule the next request when the current one's complete
            if (resp.responseJSON) {
                if ($('#myModal').is(':visible') == true && !filterUsernameBool) {
                    //request messages from server again (send also page token)
                    //after 10s
                    setTimeout(getmessages(videoId, resp.responseJSON['nextPageToken']), 10000);
                }
            }
        }
    });
}
//CALLED WHEN SEARCHING FOR UMESSAGE OF A USER
function filterUsername() {
    filterUsernameBool = true;
    if (xhr) {
        xhr.abort()
    }
    //get username and filter the massege
    var username = $('#username').val();
    filtredMessages = messages.filter(message => message['authorDetails']['displayName'] == username);
    //delete the old messages
    $("#chatMessages").empty();
    //append the filtred messages
    $.each(
        filtredMessages,
        function (intIndex, objValue) {
            $('#chatMessages').append(
                $("<div style='display:block'>" +
                    "<img height='24 width='24' class='img-circle' src=" + objValue['authorDetails']['profileImageUrl'] + "></img>" +
                    "<p class='usernameChat'>" + objValue['authorDetails']['displayName'] + "</p>" +
                    "<p style='display:inline'>&nbsp;" + objValue['snippet']['displayMessage'] + "</p></div>")
            );
        }
    );
}
//CALLED WHEN USER CLICK ON REFRESH
function refreshMessage() {
    //delete the old messages
    $("#chatMessages").empty();
    if (videoId) {
        $('#username').val('');
        messages = [];
        getmessages(videoId, '');
    }
}

//CALLED WHEN THE USER CHANGE PAGE (NEXT OR PREVIOUS)
//WE CHANGE THE INPUT (#PAGE) TO SNED IT TO THE SERVER
function toPage(nextPageToken) {
    $('#page').val(nextPageToken);
}

//CALLED WHEN USER CLICK ON STATISTICS
//IF THE USER WANT TO SHOW STATISTICS
//THE WE HIDE MESSAGES AND SHOW STATISTICS
function statistics() {
    shwoStatistics = !shwoStatistics;
    if (shwoStatistics) {
        plotChart();
        $("#player").attr('class', 'col-lg-6');
        $("#modelBodyRigth").attr('class', 'col-lg-6');
        $('#chatMessages').fadeOut("slow");
        $('#searchUser').fadeOut("slow");
        $('#plot').fadeIn("slow");
        $('#btnStat').text(function () {
            return 'Hide statistics';
        });   
    }
    else{
        $("#player").attr('class', 'col-lg-8');
        $("#modelBodyRigth").attr('class', 'col-lg-4');
        $('#plot').fadeOut("slow");        
        $('#chatMessages').fadeIn("slow");
        $('#searchUser').fadeIn("slow");
        $('#btnStat').text(function () {
            return 'Show statistics';
        });
    }
}

//CALLED WHEN WE NEED TO PLOT (WHEN DATA UPDATED OR THE USER CHOOSE TO SHOW STATISTICS)
function plotChart(){
    //GET THE DATE OF ALL THE MESSAGES
    messagesTime = messages.map(function (msg) {
        return new Date(msg["snippet"]["publishedAt"])
    });
    x = [];
    y = [];
    //GROUP THE MESSAGE WHICH IT HAS THE SAME DATE (H:m)
    //HANDLE THE DATA TO BY USED ON Plotly
    while (messagesTime.length) {
        var count = messagesTime.filter((el) => (el.getHours() == messagesTime[0].getHours()) &&
            (el.getMinutes() == messagesTime[0].getMinutes())).length;
        var date = messagesTime[0].getFullYear() + '/' +
            (messagesTime[0].getMonth() + 1) + '/' + messagesTime[0].getDate() + " " +
            (messagesTime[0].getHours() + 1) + ":" + (messagesTime[0].getMinutes() + 1);
        x.push(date)
        //x.push(messagesTime[0].toString());
        y.push(count);
        messagesTime = messagesTime.filter((el) => !(el.getHours() == messagesTime[0].getHours() &&
            el.getMinutes() == messagesTime[0].getMinutes()))
    }
    //Plotly OPTIONS
    var data = [
        {
            x: x,
            y: y,
            type: 'scatter',
        }
    ];
    var layout = {
        title: 'number of messages per minute',
        xaxis: {
          titlefont: {
            family: 'Courier New, monospace',
            size: 18,
            color: '#272727',
            tickformat: "%H~%M"
          }
        },
        yaxis: {
          title: 'Count',
          titlefont: {
            family: 'Courier New, monospace',
            size: 18,
            color: '#272727'
          }
        }
      };
    Plotly.newPlot('plot', data, layout);
}
