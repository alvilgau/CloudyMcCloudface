module Tenant exposing (Tenant, encode, set, TenantField(..), default, custom, CustomTenant, get, init)

import Json.Encode exposing (object, string, null)


type Tenant
    = Default CustomTenant
    | Custom CustomTenant


type TenantField
    = ConsumerKey
    | Token
    | ConsumerSecret
    | TokenSecret


init : Tenant
init =
    Default <| CustomTenant "" "" "" ""


default : Tenant -> Tenant
default prev =
    Default <| previous prev


custom : Tenant -> Tenant
custom prev =
    Custom <| previous prev


get : Tenant -> Maybe CustomTenant
get tenant =
    case tenant of
        Default _ ->
            Nothing

        Custom custom ->
            Just custom


isCustom tenant =
    case tenant of
        Default _ ->
            False

        Custom _ ->
            True


previous : Tenant -> CustomTenant
previous tenant =
    case tenant of
        Default custom ->
            custom

        Custom custom ->
            custom


type alias CustomTenant =
    { consumerKey : String
    , token : String
    , consumerSecret : String
    , tokenSecret : String
    }


encode : Tenant -> Json.Encode.Value
encode tenant =
    case tenant of
        Default _ ->
            null

        Custom custom ->
            object
                [ ( "consumerKey", string custom.consumerKey )
                , ( "token", string custom.token )
                , ( "consumerSecret", string custom.consumerSecret )
                , ( "tokenSecret", string custom.tokenSecret )
                ]


set : TenantField -> String -> Tenant -> Tenant
set field value tenant =
    case tenant of
        Default _ ->
            tenant

        Custom custom ->
            Custom <| set_ field value custom


set_ : TenantField -> String -> CustomTenant -> CustomTenant
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
