module Main exposing (..)

import Graph exposing (viewGraph)
import Html exposing (Html, program)
import TestData
import Keyword exposing (Keyword)
import DataPoint exposing (DataPoint)
import WebSocket
import Communication exposing (InMessage(..))



main : Program Never Model Msg
main =
    program { init = init, update = update, subscriptions = subscriptions, view = view }


type alias Model =
    { keywords : List Keyword
    , data : List DataPoint
    }


type Msg
    = NoOp
    | WSMessage String


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        NoOp ->
            model ! []

        WSMessage data ->
            webSocketReceived data model ! []
            model ! []


subscriptions : Model -> Sub Msg
subscriptions model =
    WebSocket.listen "wss://echo.websocket.org" WSMessage


view : Model -> Html Msg
view model =
    div [] [ viewGraph model.keywords model.data
    ]

webSocketReceived data model =
    case (Communication.handleMessage data) of



init : ( Model, Cmd Msg )
init =
    { keywords = TestData.keywords, data = TestData.data } ! []
