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
import Date
import Task
import Regex exposing (regex, HowMany(..))
import CreateRecordingPageModel


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
                        ( model.tenant, Nothing, Tenant.validate model.baseUrl.http TenantValidationCompleted selectedTenant )
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
            { model | modus = Just modus, data = [], keywords = [], selectedRecording = Nothing, createRecordingPageModel = Nothing }
                ! if modus == Tape then
                    [ RecordingApi.getRecordingList model.baseUrl.record model.tenant ]
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
                , RecordingApi.getRecordingData model.baseUrl.record recording.id
                )

        NewRecording (Ok _) ->
            { model | createRecordingPageModel = Nothing } ! [ RecordingApi.getRecordingList model.baseUrl.record model.tenant ]

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
                { model | error = Just "Invalid twitter credentials!" } ! []

        GetRecordingDataCompleted (Ok datapoints) ->
            { model | data = List.sortBy .time datapoints } ! []

        GetRecordingDataCompleted (Err err) ->
            let
                x =
                    Debug.log "GetRecordingListCompleted" err
            in
                model ! []

        GetRecordingListCompleted (Ok recordings) ->
            { model | recordings = Just <| List.sortWith (\r1 r2 -> compare (Date.toTime r2.begin) (Date.toTime r1.begin)) recordings } ! []

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
            let
                ( createRecordingPageModel, cmd ) =
                    CreateRecordingPageModel.init
            in
                { model | createRecordingPageModel = Just createRecordingPageModel } ! [ Cmd.map RecordingEdited cmd ]

        RecordingEdited msg ->
            let
                ( createRecordingPageModel, cmd ) =
                    model.createRecordingPageModel
                        |> Maybe.map (CreateRecordingPageModel.update (RecordingApi.postRecording model.baseUrl.record model.tenant) msg)
                        |> Maybe.map (Tuple.mapFirst Just)
                        |> Maybe.withDefault ( Nothing, Cmd.none )
            in
                { model | createRecordingPageModel = createRecordingPageModel } ! [ cmd ]


setLastQueryTime : Cmd Msg
setLastQueryTime =
    Task.perform SetLastQueryTime Time.now


subscriptions : Model -> Sub Msg
subscriptions model =
    Sub.batch <|
        case model.modus of
            Just Live ->
                if Tenant.isSelected model.tenant && List.length model.keywords > 0 then
                    [ WebSocket.listen model.baseUrl.ws WSMessage
                    , Time.every second Tick
                    ]
                else
                    []

            _ ->
                []


queryKeywordsCmd : Model -> Cmd Msg
queryKeywordsCmd model =
    let
        keywordNames =
            List.map .name model.keywords
    in
        Just (Cmd.batch [ Communication.queryKeywordsCmd model.tenant model.baseUrl.ws keywordNames, setLastQueryTime ])
            |> Maybe.filter (\_ -> List.length keywordNames > 0)
            |> Maybe.withDefault Cmd.none


webSocketReceived : String -> Model -> Model
webSocketReceived encodedData model =
    case (Communication.handleMessage encodedData) of
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
    , baseUrl = baseUrl location
    , selectedRecording = Nothing
    , createRecordingPageModel = Nothing
    , error = Nothing
    }
        ! []


baseUrl : Location -> BaseUrl
baseUrl location =
    { http = location.origin
    , ws = Regex.replace (AtMost 1) (regex "http") (\_ -> "ws") location.origin
    , record = "http://localhost:3010"
    }
