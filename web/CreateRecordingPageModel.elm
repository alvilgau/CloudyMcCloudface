module CreateRecordingPageModel exposing (..)

import DateTimePicker
import Date exposing (Date)
import Keyword exposing (Keyword)


type Msg
    = DateTimeChanged DTPicker DateTimePicker.State (Maybe Date)
    | KeywordsEdited (List String)
    | Submit


type DTPicker
    = Begin
    | End


type alias CreateRecordingPageModel =
    { beginValue : Maybe Date
    , beginState : DateTimePicker.State
    , endValue : Maybe Date
    , endState : DateTimePicker.State
    , keywords : List String
    }


update submitCmd msg model =
    case msg of
        DateTimeChanged Begin state date ->
            { model | beginState = state, beginValue = date } ! []

        DateTimeChanged End state date ->
            { model | endState = state, endValue = date } ! []

        KeywordsEdited keywords ->
            { model | keywords = keywords } ! []

        Submit ->
            model ! [ submitCmd model.beginValue model.endValue model.keywords ]


init =
    ( CreateRecordingPageModel Nothing DateTimePicker.initialState Nothing DateTimePicker.initialState []
    , Cmd.batch
        [ DateTimePicker.initialCmd (DateTimeChanged Begin) DateTimePicker.initialState
        , DateTimePicker.initialCmd (DateTimeChanged End) DateTimePicker.initialState
        ]
    )
