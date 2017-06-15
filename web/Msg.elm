module Msg exposing (..)

import Time exposing (Time)
import Tenant
import Model exposing (..)
import Http
import DataPoint exposing (DataPoint)
import Recording exposing (Recording)


type Msg
    = NoOp
    | WSMessage String
    | Query
    | Remove String
    | Add String
    | KeywordEdited String
    | TenantEdited Tenant.TenantField String
    | TenantSelected Tenant.Tenant
    | Tick Time
    | SelectModus Modus
    | SelectRecording Recording
    | SetLastQueryTime Time
    | NewRecording (Result Http.Error String)
    | TenantValidationCompleted (Result Http.Error Tenant.Tenant)
    | GetRecordingDataCompleted (Result Http.Error (List DataPoint))
    | GetRecordingListCompleted (Result Http.Error (List Recording))
    | HideError
    | CreateNewRecording
    | RecordingEdited Recording.Field
