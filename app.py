from flask import Flask, render_template, request,redirect,jsonify,session,url_for
from google.auth.transport import requests
import google.oauth2.credentials
import google_auth_oauthlib.flow
import googleapiclient.discovery
import os, requests
from dotenv import load_dotenv
# explicitly providing path to '.env'
load_dotenv()

#get data from env

CLIENT_ID = str(os.getenv("CLIENT_ID"))
CLIENT_SECRET = str(os.getenv("CLIENT_SECRET"))
AUTH_URI = str(os.getenv("AUTH_URI"))
TOKEN_URI = str(os.getenv("TOKEN_URI"))
REDIRECT_URIS = str(os.getenv("REDIRECT_URIS"))
SECRET_KEY= str(os.getenv("SECRET_KEY"))

CLIENT_SECRETS_FILE = {
	"web": {
	"client_id" :CLIENT_ID,
	"client_secret" : CLIENT_SECRET,
	"auth_uri": AUTH_URI,
	"token_uri": TOKEN_URI,
	"redirect_uris": REDIRECT_URIS
	}
}


# This OAuth 2.0 access scope allows for full read/write access to the
# authenticated user's account and requires requests to use an SSL connection.
SCOPES = ['https://www.googleapis.com/auth/drive.metadata.readonly','https://www.googleapis.com/auth/plus.me', 'https://www.googleapis.com/auth/youtube.force-ssl']
YOUTUBE_SERVICE_NAME = 'youtube'
YOUTUBE_VERSION = 'v3'

#get user information (img anf user name) based on google plus service
GOOGLE_PLUS_SCOPE = "https://www.googleapis.com/auth/plus.me"
GOOGLE_PLUS_SERVICE_NAME = "plus"
GOOGLE_PLUS_VERSION = "v1"

app = Flask(__name__, template_folder='./html-templates', static_folder='./assets')
app.secret_key = SECRET_KEY

#when the user log in for the first time. this query retun the list of videos relative to qFirstSearch
qFirstSearch = "Games"


@app.route('/')
def index():
    if 'credentials' not in session:
        return redirect('authorize')
    client, user = get_user_youtubes_service()
    video_list = search_video(client, part='snippet', eventType='live', videoEmbeddable='true',
                                maxResults=12, q=qFirstSearch, type='video')
    return render_template('index.html', user=user, video_list= video_list, qSearch=qFirstSearch )
@app.route('/authorize')
def authorize():
    # Create flow instance to manage the OAuth 2.0 Authorization Grant Flow steps.
    flow = google_auth_oauthlib.flow.Flow.from_client_config(
        CLIENT_SECRETS_FILE, scopes=SCOPES)

    flow.redirect_uri = url_for('oauth2callback', _external=True)
    authorization_url, state = flow.authorization_url(
        # Enable offline access so that you can refresh an access token without
        # re-prompting the user for permission. Recommended for web server apps.
        access_type='offline',
        # Enable incremental authorization. Recommended as a best practice.
        include_granted_scopes='true')

    # Store the state so the callback can verify the auth server response.
    session['state'] = state
    return redirect(authorization_url)

@app.route('/oauth2callback')
def oauth2callback():
    # Specify the state when creating the flow in the callback so that it can
    # verified in the authorization server response.
    state = session['state']

    flow = google_auth_oauthlib.flow.Flow.from_client_config(
        CLIENT_SECRETS_FILE, scopes=SCOPES, state=state)
    flow.redirect_uri = url_for('oauth2callback', _external=True)

    # Use the authorization server's response to fetch the OAuth 2.0 tokens.
    authorization_response = request.url
    flow.fetch_token(authorization_response=authorization_response)

    # Store credentials in the session.
    # ACTION ITEM: In a production app, you likely want to save these
    #              credentials in a persistent database instead.
    credentials = flow.credentials
    session['credentials'] = credentials_to_dict(credentials)

    return redirect(url_for('index'))

@app.route('/search')
def search():
    if 'credentials' not in session:
        return redirect('authorize')  
    searchValue = request.args['search']
    client, user = get_user_youtubes_service()
    video_list = search_video(client, part='snippet', eventType='live', 
    maxResults=12, q=searchValue, type='video')
    return render_template('index.html', user=user, video_list= video_list, qSearch=searchValue )

@app.route('/toPage')
def to_page():
    if 'credentials' not in session:
        return redirect('authorize')  
    searchValue = request.args['q']
    pageToken = request.args['page']
    client, user = get_user_youtubes_service()
    if pageToken != '':
        video_list = search_video(client, part='snippet', eventType='live', 
        maxResults=12, q=searchValue, type='video', pageToken=pageToken)
        return render_template('index.html', user=user, video_list= video_list, qSearch=searchValue )
    else:
        return jsonify({"code":400, "error": "page doesn't exist"})

@app.route('/liveChat')
def liveChat():
    videoId = request.args['videoId']
    nextPageToken = request.args['nextPageToken']
    client, user = get_user_youtubes_service()
    #IF THE NEXT PAGE TOKEN IS '' THEN WE GET THE MESSAGES WIHTOUT PAGE TOKEN
    if nextPageToken != '':
        chat_messages = live_chat(client,videoId=videoId, part='snippet,authorDetails', pageToken=nextPageToken)
    else:
        chat_messages = live_chat(client,videoId=videoId, part='snippet,authorDetails')
    return jsonify(chat_messages)

@app.route('/logout')
def logout():
    if 'credentials' in session:
        del session['credentials']
        del session['user']

    return redirect(url_for('index'))
#GET USER AND YOUTUBE SERVICE USED FOR VARIOUS ROUTE
def get_user_youtubes_service(): 
    # Load credentials from the session.
    credentials = google.oauth2.credentials.Credentials(
      **session['credentials'])
    if 'user' not in session:
        userservice = googleapiclient.discovery.build(GOOGLE_PLUS_SERVICE_NAME, 
        GOOGLE_PLUS_VERSION,credentials=credentials)
        userpeople = userservice.people()
        user_info = userpeople.get(userId="me").execute()
        user={
            'username': user_info['displayName'],
            'img': user_info['image']['url']
        }
        session['user'] = user
    else:
        user = session['user'] 
    client = googleapiclient.discovery.build(
    YOUTUBE_SERVICE_NAME, YOUTUBE_VERSION, credentials=credentials)
    return client, user


def credentials_to_dict(credentials):
  return {'token': credentials.token,
          'refresh_token': credentials.refresh_token,
          'token_uri': credentials.token_uri,
          'client_id': credentials.client_id,
          'client_secret': credentials.client_secret,
          'scopes': credentials.scopes}


def search_video(client, **kwargs):
    response = client.search().list(
        **kwargs
    ).execute()
    video_list = {'items':response['items']}
    if('nextPageToken' in response):
        video_list['nextPageToken'] = response['nextPageToken']
    if('prevPageToken' in response):
        video_list['prevPageToken'] = response['prevPageToken']     
    return video_list

def live_chat(client, videoId, **kwargs):
    video_response = client.videos().list(
    id=videoId,
    part='snippet, liveStreamingDetails, statistics').execute()
    liveChatID = video_response['items'][0]['liveStreamingDetails']['activeLiveChatId']
    r = client.liveChatMessages().list(**kwargs, liveChatId=liveChatID).execute()
    return r


if __name__ == '__main__':
    # Specify a hostname and port that are set as a valid redirect URI
    # for your API project in the Google API Console.
    app.run('localhost', 5000, debug=True)
