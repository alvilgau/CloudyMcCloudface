module RecordingApi exposing (..)

import Json.Encode as Encode
import Json.Decode as Decode
import Tenant
import Http
import Msg exposing (..)
import Recording
import DataPoint


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


postRecording : String -> Tenant.Tenant -> Float -> Float -> List String -> Cmd Msg
postRecording host tenant begin end keywords =
    let
        encodedKeywords =
            keywords
                |> List.map Encode.string
                |> Encode.list

        payload =
            Encode.object
                [ ( "tenant", Tenant.encode tenant )
                , ( "begin", Encode.float begin )
                , ( "end", Encode.float end )
                , ( "keywords", encodedKeywords )
                ]
                |> Http.jsonBody
    in
        Http.post (host ++ "/records") payload (Decode.succeed "")
            |> Http.send NewRecording
