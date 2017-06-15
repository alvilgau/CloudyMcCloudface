module Main exposing (..)

import Keyword exposing (Keyword)
import WebSocket
import Navigation exposing (program, Location)
import Communication exposing (InMessage(..))
import Tenant exposing (Tenant)
import Maybe.Extra as Maybe
import Time exposing (second, Time, inMilliseconds)
import Msg exposing (..)
import View
import Model exposing (..)
import RecordingApi
import Task
import Regex exposing (regex, HowMany(..))
import Recording


main : Program Never Model Msg
main =
    program (\_ -> NoOp) { init = init, update = update, subscriptions = subscriptions, view = View.view }


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        NoOp ->
            model ! []

        WSMessage data ->
            webSocketReceived data model
                ! []

        Query ->
            model ! [ queryKeywordsCmd model ]

        Remove name ->
            let
                keywords =
                    List.filter (\k -> k.name /= name) model.keywords
                        |> Keyword.zipWithColor

                data =
                    List.filter (\dp -> dp.keyword /= name) model.data

                model_ =
                    { model | keywords = keywords, data = data }
            in
                model_ ! [ queryKeywordsCmd model_ ]

        Add name ->
            let
                keywords =
                    List.append model.keywords [ Keyword name "" ]
                        |> Keyword.zipWithColor

                model_ =
                    { model | keywords = keywords, editedKeyword = "" }
            in
                model_ ! [ queryKeywordsCmd model_ ]

        KeywordEdited keyword ->
            { model | editedKeyword = keyword } ! []

        TenantEdited fieldId value ->
            let
                tenant =
                    Tenant.set fieldId value model.tenant
            in
                { model | tenant = tenant } ! []

        TenantSelected selectedTenant ->
            let
                ( tenant, modus, cmd ) =
                    if Tenant.isCustom selectedTenant then
                        ( model.tenant, Nothing, Tenant.validate "http://localhost:3000" TenantValidationCompleted selectedTenant )
                    else
                        ( selectedTenant, Just Live, Cmd.none )
            in
                { model | tenant = tenant, modus = modus } ! [ queryKeywordsCmd model, cmd ]

        Tick time ->
            let
                reconnectCmd =
                    Just (queryKeywordsCmd model)
                        |> Maybe.filter (\_ -> List.all (\dp -> dp.time < (inMilliseconds time) - 20000) model.data)
                        |> Maybe.filter (\_ -> model.lastQuery < (inMilliseconds time) - 20000)
                        |> Maybe.toList

                data =
                    model.data
                        |> List.filter (\dp -> dp.time > (inMilliseconds time) - (5 * 60 * 1000))
            in
                { model | data = data } ! reconnectCmd

        SelectModus modus ->
            { model | modus = Just modus, data = [], keywords = [], selectedRecording = Nothing, editedRecording = Nothing }
                ! if modus == Tape then
                    [ RecordingApi.getRecordingList model.origin.http model.tenant ]
                  else
                    []

        SelectRecording recording ->
            let
                keywords =
                    recording.keywords
                        |> List.map (\name -> Keyword name "")
                        |> Keyword.zipWithColor
            in
                ( { model | selectedRecording = Just recording.id, keywords = keywords }
                , RecordingApi.getRecordingData model.origin.http recording.id
                )

        NewRecording (Ok _) ->
            model ! [ RecordingApi.getRecordingList model.origin.http model.tenant ]

        NewRecording (Err err) ->
            let
                x =
                    Debug.log "GetRecordingListCompleted" err
            in
                model ! []

        TenantValidationCompleted (Ok tenant) ->
            { model | tenant = tenant } ! []

        TenantValidationCompleted (Err err) ->
            let
                x =
                    Debug.log "TenantValidationCompleted" err
            in
                { model | error = Just "Tenant not valid!" } ! []

        GetRecordingDataCompleted (Ok datapoints) ->
            { model | data = List.sortBy .time datapoints } ! []

        GetRecordingDataCompleted (Err err) ->
            let
                x =
                    Debug.log "GetRecordingListCompleted" err
            in
                model ! []

        GetRecordingListCompleted (Ok recordings) ->
            { model | recordings = Just recordings } ! []

        GetRecordingListCompleted (Err err) ->
            let
                x =
                    Debug.log "GetRecordingListCompleted" err
            in
                model ! []

        SetLastQueryTime time ->
            { model | lastQuery = time } ! []

        HideError ->
            { model | error = Nothing } ! []

        CreateNewRecording ->
            { model | editedRecording = Just Recording.init } ! []

        RecordingEdited field ->
            { model | editedRecording = Maybe.map (Recording.set field) model.editedRecording } ! []


setLastQueryTime =
    Task.perform SetLastQueryTime Time.now


subscriptions : Model -> Sub Msg
subscriptions model =
    Sub.batch <|
        case model.modus of
            Just Live ->
                if Tenant.isSelected model.tenant && List.length model.keywords > 0 then
                    [ WebSocket.listen model.origin.ws WSMessage
                    , Time.every second Tick
                    ]
                else
                    []

            _ ->
                []


queryKeywordsCmd model =
    let
        keywordNames =
            List.map .name model.keywords
    in
        Just (Cmd.batch [ Communication.queryKeywordsCmd model.tenant model.origin.ws keywordNames, setLastQueryTime ])
            |> Maybe.filter (\_ -> List.length keywordNames > 0)
            |> Maybe.withDefault Cmd.none


webSocketReceived data model =
    case (Communication.handleMessage data) of
        Data data ->
            { model | data = (data :: model.data) }

        Invalid error ->
            model


init : Location -> ( Model, Cmd Msg )
init location =
    { keywords = []
    , data = []
    , editedKeyword = ""
    , tenant = Tenant.init
    , lastQuery = 0
    , modus = Nothing
    , recordings = Nothing
    , origin = origin location
    , selectedRecording = Nothing
    , editedRecording = Nothing
    , error = Nothing
    }
        ! []


origin location =
    { http = "http://localhost:3010"
    , ws = "ws://localhost:3000"
    }



-- origin location =
--     { http = location.origin
--     , ws = Regex.replace (AtMost 1) (regex "http") (\_ -> "ws") location.origin
--     }