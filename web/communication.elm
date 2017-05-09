module Communication exposing (..)

import Json.Decode exposing (decodeString, field, list, map2, string, nullable, oneOf, map, at, maybe, float)
import Json.Encode as Encode
import WebSocket
import DataPoint exposing (decode, DataPoint)


type InMessage
    = Data (List DataPoint)
    | Invalid String


handleMessage : String -> InMessage
handleMessage msg =
    case decodeString inMessageDecoder (Debug.log "JSON:" msg) of
        Ok inMessage ->
            inMessage

        Err e ->
            Invalid <| Debug.log "Error" e


queryKeywordsCmd : List String -> Cmd msg
queryKeywordsCmd keywords =
    keywords
        |> List.map (\k -> Encode.string k)
        |> Encode.list
        |> Encode.encode 0
        |> WebSocket.send "ws://localhost:9000/socket"


inMessageDecoder : Json.Decode.Decoder InMessage
inMessageDecoder =
    oneOf [ dataDecoder ]


dataDecoder : Json.Decode.Decoder InMessage
dataDecoder =
    map Data (list DataPoint.decode)
