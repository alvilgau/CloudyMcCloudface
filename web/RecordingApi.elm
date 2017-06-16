module RecordingApi exposing (..)

import Json.Encode as Encode
import Json.Decode as Decode
import Tenant
import Http
import Msg exposing (..)
import Recording
import DataPoint
import Date exposing (Date)


host =
    "http://localhost:52865"


getRecordingList : String -> Tenant.Tenant -> Cmd Msg
getRecordingList host tenant =
    Http.get (host ++ "/tenants/" ++ tenant.fields.consumerKey ++ "/records") (Decode.list Recording.decode)
        |> Http.send GetRecordingListCompleted


getRecordingData : String -> String -> Cmd Msg
getRecordingData host recordId =
    Http.get (host ++ "/records/" ++ recordId ++ "/tweets") recordingResultDecoder
        |> Http.send GetRecordingDataCompleted


recordingResultDecoder =
    (Decode.field "data" (Decode.list DataPoint.decode))


postRecording : String -> Tenant.Tenant -> Maybe Date.Date -> Maybe Date.Date -> List String -> Cmd Msg
postRecording host tenant begin end keywords =
    let
        encodedKeywords =
            keywords
                |> List.map Encode.string
                |> Encode.list

        beginEnd =
            [ Maybe.map (Date.toTime >> Encode.float >> ((,) "begin")) begin
            , Maybe.map (Date.toTime >> Encode.float >> ((,) "end")) end
            ]
                |> List.filterMap identity

        payload =
            Encode.object
                ([ ( "tenant", Tenant.encode tenant )
                 , ( "keywords", encodedKeywords )
                 ]
                    ++ beginEnd
                )
                |> Http.jsonBody
    in
        Http.post (host ++ "/records") payload (Decode.succeed "")
            |> Http.send NewRecording
