module Tenant exposing (Tenant, TenantFields, TenantField(..), encode, set, default, custom, init, isSelected, isCustom, validate)

import Json.Encode exposing (object, string, null)
import Json.Decode as Decode
import Http


type TenantType
    = None
    | Default
    | Custom


type alias Tenant =
    { type_ : TenantType
    , fields : TenantFields
    }


type TenantField
    = ConsumerKey
    | Token
    | ConsumerSecret
    | TokenSecret


type alias TenantFields =
    { consumerKey : String
    , token : String
    , consumerSecret : String
    , tokenSecret : String
    }


init : Tenant
init =
    Tenant None initCustom


initCustom : TenantFields
initCustom =
    TenantFields "" "" "" ""


default : Tenant -> Tenant
default tenant =
    { tenant | type_ = Default }


custom : Tenant -> Tenant
custom tenant =
    { tenant | type_ = Custom }


isSelected : Tenant -> Bool
isSelected tenant =
    case tenant.type_ of
        None ->
            False

        _ ->
            True


isCustom : Tenant -> Bool
isCustom tenant =
    case tenant.type_ of
        Custom ->
            True

        _ ->
            False


validate : String -> (Result Http.Error Tenant -> msg) -> Tenant -> Cmd msg
validate urlBase msg tenant =
    let
        body =
            encodeInternal tenant.fields
                |> Http.jsonBody
    in
        Http.post (urlBase ++ "/tenants/validate") body (Decode.succeed tenant)
            |> Http.send msg


encode : Tenant -> Json.Encode.Value
encode tenant =
    case tenant.type_ of
        Custom ->
            encodeInternal tenant.fields

        _ ->
            null


encodeInternal fields =
    object
        [ ( "consumerKey", string fields.consumerKey )
        , ( "token", string fields.token )
        , ( "consumerSecret", string fields.consumerSecret )
        , ( "tokenSecret", string fields.tokenSecret )
        ]


set : TenantField -> String -> Tenant -> Tenant
set field value tenant =
    { tenant | fields = set_ field value tenant.fields }


set_ : TenantField -> String -> TenantFields -> TenantFields
set_ field value tenant =
    case field of
        ConsumerKey ->
            { tenant | consumerKey = value }

        Token ->
            { tenant | token = value }

        ConsumerSecret ->
            { tenant | consumerSecret = value }

        TokenSecret ->
            { tenant | tokenSecret = value }
